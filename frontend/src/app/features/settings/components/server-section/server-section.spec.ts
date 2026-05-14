import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServerSection } from './server-section';

describe('ServerSection', () => {
  let component: ServerSection;
  let fixture: ComponentFixture<ServerSection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerSection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServerSection);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
